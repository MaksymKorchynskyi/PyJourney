# Пропуск тестів

Не кожен тест може чи повинен виконуватися будь-де. Тестові може знадобитися Windows, новіша версія Python, необов'язкова бібліотека або ключ API, який є лише на сервері CI. Замість того щоб коментувати такі тести, `unittest` дозволяє їх **пропустити** (skip): тест залишається в коді, звіт показує, що його пропущено і чому, а запуск усе одно вважається успішним.

## Що ви дізнаєтесь

- Три способи пропустити тест: `@unittest.skip()`, `self.skipTest()` і `raise unittest.SkipTest`
- Як пропустити цілий клас або цілий модуль
- Як пропускати тести за умовою через `@unittest.skipIf()` і `@unittest.skipUnless()`
- Коли ухвалювати рішення під час імпорту, а коли — під час виконання
- Як `@unittest.expectedFailure` позначає відому помилку і що таке «неочікуваний успіх»
- Як пропущені тести виглядають у звіті та як вони взаємодіють із `setUp()` і `tearDown()`

## Чому пропускати, а не видаляти чи коментувати

Закоментований тест невидимий: його ніхто не бачить у звіті, і він тихо застаріває. Пропущений тест:

- і далі збирається та показується в списку разом із **причиною**, яку ви вказали;
- з'являється в підсумку як `skipped=N`, тож команда знає, що покриття неповне;
- автоматично знову запускається, щойно його умова перестає діяти (наприклад, після встановлення бібліотеки, якої бракувало).

Пропуск ніколи не робить запуск невдалим. `OK (skipped=1)` завершується з кодом `0`.

## Три способи пропустити тест

### Декоратор `@unittest.skip()`

Декоратор пропускає тест безумовно. Аргумент — причина, яку буде показано у звіті:

```python
import unittest


class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    @unittest.skip("Work in progress")
    def test_case_2(self):
        self.assertEqual(2 * 2, 5)
```

Запуск (файл називається `test_skipping.py`):

```bash
python3 -m unittest -v
```

Результат (час щоразу інший):

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... ok
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

`test_case_2` містить хибне твердження, але його тіло не виконується. Без `-v` пропущений тест позначається символом `s`:

```text
.s
----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Зверніть увагу, що «Ran 2 tests» враховує й пропущений тест: його зібрали й опрацювали, просто не виконали.

### Метод `skipTest()`

`self.skipTest(reason)` пропускає поточний тест **зсередини**, під час виконання. Ніщо після цього виклику не виконується:

```python
import unittest


class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    def test_case_2(self):
        self.skipTest("Work in progress")
        self.assertEqual(2 * 2, 5)
```

Результат `python3 -m unittest -v`:

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... ok
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Використовуйте його, коли рішення залежить від того, що стає відомо лише під час виконання тесту, наприклад чи відповів сервер або чи знайшовся файл.

### Генерування `unittest.SkipTest`

`skipTest()` працює так: генерує виняток `unittest.SkipTest`. Ви можете згенерувати його й самі:

```python
import unittest


class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    def test_case_2(self):
        raise unittest.SkipTest("Work in progress")
```

Результат `python3 -m unittest -v`:

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... ok
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Усередині тестового методу `self.skipTest()` читається краще. Пряме генерування `SkipTest` корисне там, де немає `self`: у `setUpClass()`, у `setUpModule()`, на рівні модуля або в допоміжній функції, спільній для кількох тестових класів.

## Пропуск цілого класу

Поставте декоратор на клас — і всі його тести буде пропущено:

```python
import unittest


@unittest.skip("Work in progress")
class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    def test_case_2(self):
        self.assertIsNotNone([])
```

Результат `python3 -m unittest -v`:

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... skipped 'Work in progress'
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=2)
```

Щоб пропустити клас за результатом перевірки під час виконання, згенеруйте `SkipTest` у `setUpClass()`. Тоді підготовка класу показується у звіті як один пропущений елемент, а жоден тест класу не запускається:

```python
import os
import unittest


class TestApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token = os.environ.get("API_TOKEN")
        if cls.token is None:
            raise unittest.SkipTest("API_TOKEN is not set")

    def test_token_format(self):
        self.assertTrue(self.token.startswith("tok_"))

    def test_token_length(self):
        self.assertGreater(len(self.token), 4)
```

Результат `python3 -m unittest -v` без змінної середовища:

```text
setUpClass (test_runtime.TestApi) ... skipped 'API_TOKEN is not set'

----------------------------------------------------------------------
Ran 0 tests in 0.000s

OK (skipped=1)
```

Якщо змінну встановлено (`API_TOKEN=tok_12345 python3 -m unittest -v` у macOS/Linux):

```text
test_token_format (test_runtime.TestApi.test_token_format) ... ok
test_token_length (test_runtime.TestApi.test_token_length) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

## Пропуск цілого модуля

Якщо згенерувати `SkipTest` на верхньому рівні тестового модуля, буде пропущено все, що в ньому є. Так зазвичай обробляють необов'язкову залежність:

```python
import unittest

try:
    import yaml
except ImportError:
    raise unittest.SkipTest("PyYAML is not installed")


class TestYamlConfig(unittest.TestCase):
    def test_load_mapping(self):
        self.assertEqual(yaml.safe_load("port: 8080"), {"port": 8080})

    def test_load_list(self):
        self.assertEqual(yaml.safe_load("- a\n- b"), ["a", "b"])
```

Результат `python3 -m unittest -v` у середовищі без PyYAML:

```text
test_yaml_config (unittest.loader.ModuleSkipped.test_yaml_config) ... skipped 'PyYAML is not installed'

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK (skipped=1)
```

Завантажувач замінює весь модуль одним тестом-заповнювачем `ModuleSkipped`. Якщо PyYAML встановлено, обидва тести виконуються як зазвичай.

## Пропуск за умовою

Часто тест має сенс лише в певних середовищах. Два декоратори приймають умову й причину:

```text
@unittest.skipIf(condition, reason)      # пропустити, якщо умова істинна
@unittest.skipUnless(condition, reason)  # пропустити, якщо умова хибна
```

`skipUnless(c, r)` — те саме, що `skipIf(not c, r)`. Обирайте варіант, який звучить природніше: «пропустити, якщо Windows», «пропустити, якщо не встановлено numpy».

```python
import importlib.util
import sys
import unittest

HAS_NUMPY = importlib.util.find_spec("numpy") is not None


class TestConditions(unittest.TestCase):
    @unittest.skipIf(sys.platform.startswith("win"), "Do not run on Windows")
    def test_posix_paths(self):
        self.assertEqual("/usr/bin".split("/"), ["", "usr", "bin"])

    @unittest.skipUnless(sys.platform.startswith("win"), "Requires Windows")
    def test_windows_drive(self):
        self.assertTrue("C:\\".endswith("\\"))

    @unittest.skipIf(sys.version_info < (3, 12), "Needs Python 3.12+")
    def test_batched(self):
        from itertools import batched
        self.assertEqual(list(batched("abcde", 2)), [("a", "b"), ("c", "d"), ("e",)])

    @unittest.skipUnless(HAS_NUMPY, "numpy is not installed")
    def test_numpy_sum(self):
        import numpy as np
        self.assertEqual(np.arange(4).sum(), 6)
```

Результат `python3 -m unittest -v` у macOS із Python 3.14 і без numpy:

```text
test_batched (test_conditions.TestConditions.test_batched) ... ok
test_numpy_sum (test_conditions.TestConditions.test_numpy_sum) ... skipped 'numpy is not installed'
test_posix_paths (test_conditions.TestConditions.test_posix_paths) ... ok
test_windows_drive (test_conditions.TestConditions.test_windows_drive) ... skipped 'Requires Windows'

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK (skipped=2)
```

У Windows `test_posix_paths` було б пропущено, а `test_windows_drive` — виконано. Якщо numpy встановлено, виконується й `test_numpy_sum`.

Корисні умови:

- `sys.platform`: `"win32"`, `"darwin"` (macOS), `"linux"`. Поширена перевірка на Windows — `sys.platform.startswith("win")`.
- `sys.version_info`: порівнюйте з кортежем, наприклад `sys.version_info >= (3, 12)`.
- `importlib.util.find_spec("name") is not None`: чи встановлено модуль (без його імпорту).
- `shutil.which("git") is not None`: чи доступна утиліта командного рядка.
- `os.environ.get("NAME")`: чи встановлено змінну середовища.

> **Зверніть увагу:** умова `skipIf()`/`skipUnless()` обчислюється **один раз, під час імпорту модуля**, коли виконується тіло класу. Вона не бачить нічого, що станеться пізніше, наприклад файлу, створеного в `setUpClass()`. Для рішень, які залежать від стану під час виконання, викликайте `self.skipTest()` усередині тесту чи `setUp()`.

## Пропуск усередині підтесту

Якщо викликати `skipTest()` усередині `with self.subTest(...)`, буде пропущено лише цей підтест. Цикл продовжиться з наступним значенням:

```python
import unittest


class TestSquares(unittest.TestCase):
    def test_square_roots(self):
        for n in (4, -1, 9):
            with self.subTest(n=n):
                if n < 0:
                    self.skipTest("negative numbers have no real square root")
                self.assertEqual((n ** 0.5) ** 2, n)
```

Результат `python3 -m unittest test_subtests -v`:

```text
test_square_roots (test_subtests.TestSquares.test_square_roots) ...
  test_square_roots (test_subtests.TestSquares.test_square_roots) (n=-1) ... skipped 'negative numbers have no real square root'

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK (skipped=1)
```

Значення `4` і `9` все одно перевірено. Пропущено лише підтест `n=-1`.

## Пропуски й тестові оточення

Для тестового оточення важливо, коли саме тест пропускається:

```python
import unittest


class TestSetupSkip(unittest.TestCase):
    def setUp(self):
        print("setUp")

    def tearDown(self):
        print("tearDown")

    @unittest.skip("decorated")
    def test_decorated(self):
        print("body 1")

    def test_runtime(self):
        print("body 2")
        self.skipTest("at runtime")
        print("never printed")
```

Результат `python3 -m unittest test_setup_skip -v` у терміналі:

```text
test_decorated (test_setup_skip.TestSetupSkip.test_decorated) ... skipped 'decorated'
test_runtime (test_setup_skip.TestSetupSkip.test_runtime) ... setUp
body 2
skipped 'at runtime'
tearDown

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=2)
```

- Тест, пропущений **декоратором**, навіть не починається: ні `setUp()`, ні `tearDown()`.
- Тест, пропущений через **`skipTest()`**, уже виконав `setUp()`, тож `tearDown()` (і функції прибирання) після нього теж виконуються. Ресурси звільняються як слід.

## Очікувані невдачі

Буває, що про помилку відомо, але виправити її поки не можна. Замість пропуску тесту позначте його декоратором `@unittest.expectedFailure`. Тест **виконується**, а невдача показується як `expected failure` («очікувана невдача»), а не як помилка:

```python
import unittest


def average(numbers):
    return sum(numbers) / len(numbers)


class TestAverage(unittest.TestCase):
    def test_average(self):
        self.assertEqual(average([2, 4, 6]), 4)

    @unittest.expectedFailure
    def test_average_of_empty_list(self):
        # відома помилка: має повертати 0, а не генерувати ZeroDivisionError
        self.assertEqual(average([]), 0)
```

Результат `python3 -m unittest -v`:

```text
test_average (test_expected.TestAverage.test_average) ... ok
test_average_of_empty_list (test_expected.TestAverage.test_average_of_empty_list) ... expected failure

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (expected failures=1)
```

У короткому форматі це символ `x`. Перевага над `skip` у тому, що тест і далі стежить за помилкою. Щойно хтось виправить `average()`, тест пройде, і цей **неочікуваний успіх** (unexpected success) зробить запуск невдалим, нагадуючи прибрати декоратор:

```python
import unittest


def average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)


class TestAverage(unittest.TestCase):
    @unittest.expectedFailure
    def test_average_of_empty_list(self):
        self.assertEqual(average([]), 0)
```

Результат `python3 -m unittest test_unexpected -v` (код завершення `1`):

```text
test_average_of_empty_list (test_unexpected.TestAverage.test_average_of_empty_list) ... unexpected success

======================================================================
UNEXPECTED SUCCESS: test_average_of_empty_list (test_unexpected.TestAverage.test_average_of_empty_list)
----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (unexpected successes=1)
```

## Типові помилки

- **Використовувати `return` замість `skipTest()`.** Ранній `return` робить тест успішним без жодної перевірки, і звіт вводить в оману:

  ```python
  import shutil
  import unittest


  class TestGit(unittest.TestCase):
      def test_git_version_bad(self):
          if shutil.which("nonexistent-tool") is None:
              return
          self.fail("unreachable here")

      def test_git_version_good(self):
          if shutil.which("nonexistent-tool") is None:
              self.skipTest("nonexistent-tool is not installed")
          self.fail("unreachable here")
  ```

  Результат `python3 -m unittest test_early_return -v` (без підсумкових рядків):

  ```text
  test_git_version_bad (test_early_return.TestGit.test_git_version_bad) ... ok
  test_git_version_good (test_early_return.TestGit.test_git_version_good) ... skipped 'nonexistent-tool is not installed'
  ```

- **Пропускати без причини.** Голий `@unittest.skip` теж приймається, але тоді звіт показує `skipped ''`, і ніхто не пам'ятає чому. Завжди пояснюйте причину, а в ідеалі — і коли пропуск можна буде прибрати.
- **Очікувати, що `skipIf()` бачить стан під час виконання.** Його умова обчислюється під час імпорту. Для всього, що вирішується пізніше, використовуйте `self.skipTest()`.
- **Забувати про пропущені тести.** Тест, пропущений «тимчасово», може залишатися пропущеним роками. Переглядайте `skipped=N` у звітах, а для відомих помилок віддавайте перевагу `expectedFailure`, бо він сповістить, коли помилку виправлять.
- **Пропускати тест, щоб приховати нестабільність чи невдачу.** Пропуск має описувати обмеження *середовища*, а не маскувати справжню проблему. Краще виправте тест або код.

## Підсумок

- Пропущені тести залишаються в коді й у звіті (`s`, `skipped 'reason'`, `OK (skipped=N)`) і не роблять запуск невдалим.
- Безумовно пропускайте через `@unittest.skip(reason)`. Під час виконання — через `self.skipTest(reason)` або `raise unittest.SkipTest(reason)`.
- Декоруйте клас, щоб пропустити всі його тести. Генеруйте `SkipTest` у `setUpClass()` або на рівні модуля, щоб пропустити клас чи модуль за результатом перевірки.
- `@unittest.skipIf(cond, reason)` пропускає, коли `cond` істинна, `@unittest.skipUnless(cond, reason)` — коли хибна. Умови обчислюються під час імпорту.
- Для тестів, пропущених декоратором, `setUp()`/`tearDown()` не виконуються. Тести, пропущені через `skipTest()`, усе одно отримують свій `tearDown()` і функції прибирання.
- `@unittest.expectedFailure` запускає тест, про який відомо, що він не проходить. Неочікуваний успіх робить запуск невдалим, тож ви помітите, коли помилку виправлять.

## Практика

### Вправа 1: Повільні тести за запитом

Напишіть `test_reports.py` з двома тестами: швидким і повільним (імітуйте його через `time.sleep(1)`), який виконується лише тоді, коли змінна середовища `RUN_SLOW` дорівнює `"1"`. Покажіть результат зі змінною і без неї.

### Вправа 2: Передбачте підсумок

Не запускаючи код, передбачте короткий вивід (`python3 -m unittest test_summary`) і підсумковий рядок для цього модуля:

```python
import unittest


class TestSummary(unittest.TestCase):
    @unittest.skip("not ready")
    def test_a(self):
        self.assertEqual(1, 2)

    @unittest.skipIf(True, "condition is true")
    def test_b(self):
        pass

    @unittest.skipUnless(True, "condition is true")
    def test_c(self):
        pass

    @unittest.expectedFailure
    def test_d(self):
        self.assertEqual(1, 2)

    def test_e(self):
        self.skipTest("decided at runtime")
```

### Вправа 3: Тести для окремих платформ

Файл `endings.py` містить:

```python
import os


def line_ending():
    return os.linesep
```

У Windows `os.linesep` дорівнює `"\r\n"`, на інших системах — `"\n"`. Напишіть два тести: один перевіряє `"\r\n"` і виконується лише у Windows, інший перевіряє `"\n"` і виконується скрізь, крім Windows.

## Розв'язки

### Вправа 1

```python
import os
import time
import unittest

RUN_SLOW = os.environ.get("RUN_SLOW") == "1"


class TestReports(unittest.TestCase):
    def test_quick(self):
        self.assertEqual(sum(range(10)), 45)

    @unittest.skipUnless(RUN_SLOW, "set RUN_SLOW=1 to run slow tests")
    def test_full_year_report(self):
        time.sleep(1)  # уявімо, що це повільне обчислення
        self.assertEqual(sum(range(1_000_000)), 499_999_500_000)
```

Результат `python3 -m unittest -v`:

```text
test_full_year_report (test_reports.TestReports.test_full_year_report) ... skipped 'set RUN_SLOW=1 to run slow tests'
test_quick (test_reports.TestReports.test_quick) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Результат `RUN_SLOW=1 python3 -m unittest -v` (у Windows PowerShell спершу виконайте `$env:RUN_SLOW = "1"`). Час — близько секунди й щоразу інший:

```text
test_full_year_report (test_reports.TestReports.test_full_year_report) ... ok
test_quick (test_reports.TestReports.test_quick) ... ok

----------------------------------------------------------------------
Ran 2 tests in 1.014s

OK
```

`RUN_SLOW` обчислюється один раз під час імпорту. Тут це нормально, бо середовище під час запуску не змінюється.

### Вправа 2

```text
ss.xs
----------------------------------------------------------------------
Ran 5 tests in 0.000s

OK (skipped=3, expected failures=1)
```

- `test_a`: `s`, пропущено декоратором. Хибне твердження так і не виконується.
- `test_b`: `s`, умова `True`, тож `skipIf` пропускає.
- `test_c`: `.`, умова `True`, тож `skipUnless` **не** пропускає, і порожній тест проходить.
- `test_d`: `x`, не проходить, як і очікувалося.
- `test_e`: `s`, пропущено під час виконання.

Код завершення — `0`: пропуски й очікувані невдачі не роблять запуск невдалим.

### Вправа 3

```python
import sys
import unittest

from endings import line_ending

IS_WINDOWS = sys.platform == "win32"


class TestLineEnding(unittest.TestCase):
    @unittest.skipUnless(IS_WINDOWS, "Windows-only behaviour")
    def test_windows_uses_crlf(self):
        self.assertEqual(line_ending(), "\r\n")

    @unittest.skipIf(IS_WINDOWS, "POSIX-only behaviour")
    def test_posix_uses_lf(self):
        self.assertEqual(line_ending(), "\n")
```

Результат `python3 -m unittest -v` у macOS чи Linux:

```text
test_posix_uses_lf (test_endings.TestLineEnding.test_posix_uses_lf) ... ok
test_windows_uses_crlf (test_endings.TestLineEnding.test_windows_uses_crlf) ... skipped 'Windows-only behaviour'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

У Windows ролі міняються: `test_windows_uses_crlf` виконується, а `test_posix_uses_lf` пропускається з причиною `'POSIX-only behaviour'`.

---

*Джерело: [pythontutorial.net — Python unittest Skip Test](https://www.pythontutorial.net/python-unit-testing/python-unittest-skip-test/). Адаптовано й доповнено для PyJourney.*
