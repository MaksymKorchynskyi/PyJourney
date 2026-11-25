# Тестові оточення (fixtures)

Більшості тестів потрібна підготовка: об'єкт у відомому стані, тимчасова папка, з'єднання з базою даних. **Тестове оточення** (test fixture) — це така підготовка разом із прибиранням після тесту. `unittest` дає змогу описати їх один раз у спеціальних методах, які автоматично виконуються навколо тестів. Тож кожен тест починає з чистого, передбачуваного стану й нічого не залишає по собі.

## Що ви дізнаєтесь

- Що таке тестове оточення і чому воно робить тести незалежними
- Як `setUp()` і `tearDown()` виконуються навколо **кожного** тестового методу
- Як `setUpClass()`/`tearDownClass()` і `setUpModule()`/`tearDownModule()` дозволяють спільно використовувати дороге налаштування
- Точний порядок виконання всіх методів оточення, зокрема коли тест не проходить
- Як `addCleanup()` і `enterContext()` гарантують прибирання, навіть якщо підготовка обірвалася на півдорозі
- Друкарські та архітектурні помилки, які непомітно ламають тестові оточення

## Що таке тестове оточення

У документації `unittest` тестове оточення визначено як «підготовку, потрібну для виконання одного або кількох тестів, і всі пов'язані з нею дії з прибирання». На практиці це код, що виконується **перед** тестом (створює об'єкти, файли, з'єднання) і **після** нього (видаляє файли, закриває з'єднання, скасовує зміни).

Тестові оточення розв'язують дві проблеми:

- **Дублювання.** Без них кожен тест повторює ті самі рядки підготовки.
- **Ізоляцію.** Оточення, яке створюється заново для кожного тесту, гарантує, що один тест не передасть свій стан наступному.

`unittest` пропонує тестові оточення на трьох рівнях:

| Рівень | Перед | Після | Коли виконується |
|---|---|---|---|
| Метод | `setUp(self)` | `tearDown(self)` | навколо **кожного** тестового методу |
| Клас | `setUpClass(cls)` | `tearDownClass(cls)` | один раз на тестовий клас |
| Модуль | `setUpModule()` | `tearDownModule()` | один раз на тестовий модуль |

Хуки рівня методу — звичайні методи, хуки рівня класу мають бути **методами класу** (class methods), а хуки рівня модуля — звичайні **функції** в тестовому файлі. Назви фіксовані, включно з великою літерою `U` у `setUp`.

## Порядок виконання

Цей тестовий модуль, `test_my_module.py`, визначає всі шість хуків і кожен із них виводить рядок:

```python
import unittest


def setUpModule():
    print("Running setUpModule")


def tearDownModule():
    print("Running tearDownModule")


class TestMyModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("Running setUpClass")

    @classmethod
    def tearDownClass(cls):
        print("Running tearDownClass")

    def setUp(self):
        print("Running setUp")

    def tearDown(self):
        print("Running tearDown")

    def test_case_1(self):
        print("Running test_case_1")
        self.assertEqual(5 + 5, 10)

    def test_case_2(self):
        print("Running test_case_2")
        self.assertEqual(1 + 1, 2)
```

Запустіть його в терміналі:

```bash
python3 -m unittest -v
```

Результат (час щоразу інший):

```text
Running setUpModule
Running setUpClass
test_case_1 (test_my_module.TestMyModule.test_case_1) ... Running setUp
Running test_case_1
Running tearDown
ok
test_case_2 (test_my_module.TestMyModule.test_case_2) ... Running setUp
Running test_case_2
Running tearDown
ok
Running tearDownClass
Running tearDownModule

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Засіб запуску виводить `test_case_1 (...) ...` *перед* початком тесту, а `ok` — *після* нього, тож рядки від методів оточення опиняються посередині. Схематично:

```text
setUpModule
  setUpClass
    setUp -> test_case_1 -> tearDown
    setUp -> test_case_2 -> tearDown
  tearDownClass
tearDownModule
```

> **Зверніть увагу:** засіб запуску пише свій звіт у *stderr*, а `print()` — у *stdout*. У терміналі вони перемежовуються, як показано вище. Якщо перенаправити вивід у файл чи конвеєр, stdout буферизується, і рядки `Running ...` можуть опинитися в іншому місці. Щоб приховати вивід тестів, які пройшли, запускайте з `-b` (buffer). У терміналі Python 3.14 ще й розфарбовує `ok`, `FAIL` і `OK`.

## Оточення рівня методу: `setUp()` і `tearDown()`

### Позбуваємося дублювання

Ось невеликий клас банківського рахунку в `bank_account.py`:

```python
class InsufficientFunds(Exception):
    pass


class BankAccount:
    def __init__(self, balance: float) -> None:
        if balance < 0:
            raise ValueError("Balance cannot be negative")
        self._balance = balance

    @property
    def balance(self) -> float:
        return self._balance

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("The amount must be positive")
        self._balance += amount

    def withdraw(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("The withdrawal amount must be positive")
        if amount > self._balance:
            raise InsufficientFunds("Insufficient funds for withdrawal")
        self._balance -= amount
```

Перша версія тестів створює той самий рахунок у кожному тесті:

```python
import unittest

from bank_account import BankAccount


class TestBankAccount(unittest.TestCase):
    def test_deposit(self):
        account = BankAccount(100)
        account.deposit(100)
        self.assertEqual(account.balance, 200)

    def test_withdraw(self):
        account = BankAccount(100)
        account.withdraw(50)
        self.assertEqual(account.balance, 50)
```

Із двома тестами повторення ще терпиме. Із двадцятьма зміна початкового балансу означає правки у двадцяти місцях. Перенесіть спільну підготовку в `setUp()` і збережіть об'єкт в атрибуті `self`:

```python
import unittest

from bank_account import BankAccount, InsufficientFunds


class TestBankAccount(unittest.TestCase):
    def setUp(self):
        self.account = BankAccount(100)

    def test_deposit(self):
        self.account.deposit(100)
        self.assertEqual(self.account.balance, 200)

    def test_withdraw(self):
        self.account.withdraw(50)
        self.assertEqual(self.account.balance, 50)

    def test_withdraw_too_much(self):
        with self.assertRaises(InsufficientFunds):
            self.account.withdraw(150)
        self.assertEqual(self.account.balance, 100)
```

Результат `python3 -m unittest -v`:

```text
test_deposit (test_bank_account.TestBankAccount.test_deposit) ... ok
test_withdraw (test_bank_account.TestBankAccount.test_withdraw) ... ok
test_withdraw_too_much (test_bank_account.TestBankAccount.test_withdraw_too_much) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`test_deposit()` збільшує баланс до 200, але `test_withdraw()` і `test_withdraw_too_much()` однаково бачать 100. Для кожного тесту засіб запуску по суті робить таке:

```text
setUp()  ->  test_deposit()            рахунок починається зі 100
setUp()  ->  test_withdraw()           зовсім новий рахунок, знову 100
setUp()  ->  test_withdraw_too_much()  зовсім новий рахунок, знову 100
```

### Кожен тест отримує новий екземпляр

Ізоляція не обмежується повторним викликом `setUp()`. `unittest` створює **окремий екземпляр тестового класу для кожного тестового методу**, тож атрибути, встановлені в одному тесті, ніколи не потрапляють до іншого:

```python
import unittest


class TestFreshInstance(unittest.TestCase):
    def setUp(self):
        self.items = []

    def test_first(self):
        self.items.append("first")
        self.assertEqual(self.items, ["first"])

    def test_second(self):
        self.items.append("second")
        self.assertEqual(self.items, ["second"])
```

Результат `python3 -m unittest test_fresh -v`:

```text
test_first (test_fresh.TestFreshInstance.test_first) ... ok
test_second (test_fresh.TestFreshInstance.test_second) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Обидва тести проходять, бо кожен отримує власний порожній список. У розділі «Типові помилки» показано, що станеться, якщо зробити список атрибутом класу.

### `tearDown()` для справжніх ресурсів

`tearDown()` виконується після кожного тесту **незалежно від того, чи тест пройшов, не пройшов чи завершився помилкою**, — за умови, що сам `setUp()` завершився успішно. Використовуйте його, щоб звільнити те, що збирач сміття не прибере за вас: файли, папки, мережеві з'єднання, змінені змінні середовища.

```python
from pathlib import Path


def save_report(folder, name, lines):
    path = Path(folder) / name
    path.write_text("\n".join(lines), encoding="utf-8")
    return path
```

Тести записують файли в тимчасову папку, яку видаляють після кожного тесту:

```python
import tempfile
import unittest
from pathlib import Path

from reports import save_report


class TestSaveReport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_creates_file(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertTrue(path.exists())

    def test_writes_lines(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertEqual(path.read_text(encoding="utf-8"), "jan\nfeb")
```

Результат `python3 -m unittest -v`:

```text
test_creates_file (test_reports.TestSaveReport.test_creates_file) ... ok
test_writes_lines (test_reports.TestSaveReport.test_writes_lines) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

> **Порада:** для звичайних об'єктів у пам'яті `tearDown()` не потрібен. Рядок `self.account = None` у `tearDown()` нічого корисного не робить: екземпляр тесту після запуску відкидається, і збирач сміття сам звільнить рахунок. Залишайте `tearDown()` для зовнішніх ресурсів.

## Прибирання: `addCleanup()` і `enterContext()`

У `tearDown()` є слабке місце: його **не викликають, якщо `setUp()` згенерував виняток**. Якщо `setUp()` відкрив два ресурси й упав на третьому, перші два залишаться незакритими. Розв'язок — реєструвати прибирання одразу після створення ресурсу через `self.addCleanup(function, *args, **kwargs)`. Зареєстровані функції прибирання:

- виконуються після `tearDown()` або після невдалого `setUp()`;
- виконуються у **зворотному порядку** реєстрації (останній зареєстрований — перший виконаний), як вкладені блоки `with`;
- виконуються, навіть якщо тест не пройшов або попередня функція прибирання згенерувала виняток.

```python
import unittest


class TestCleanupOrder(unittest.TestCase):
    def setUp(self):
        print("open resource A")
        self.addCleanup(print, "close resource A")
        print("open resource B")
        self.addCleanup(print, "close resource B")
        raise RuntimeError("resource C is unavailable")

    def tearDown(self):
        print("tearDown")

    def test_something(self):
        print("test body")
```

Результат `python3 -m unittest test_cleanup_order -v` (шлях скорочено):

```text
test_something (test_cleanup_order.TestCleanupOrder.test_something) ... open resource A
open resource B
ERROR
close resource B
close resource A

======================================================================
ERROR: test_something (test_cleanup_order.TestCleanupOrder.test_something)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_cleanup_order.py", line 10, in setUp
    raise RuntimeError("resource C is unavailable")
RuntimeError: resource C is unavailable

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (errors=1)
```

Ні `test body`, ні `tearDown` не виведено, але обидві зареєстровані функції прибирання спрацювали: спершу B, потім A.

Багато ресурсів є менеджерами контексту (об'єктами для `with`). Починаючи з **Python 3.11**, `self.enterContext(cm)` входить у менеджер контексту, повертає те, що повертає його `__enter__()`, і реєструє вихід із нього як функцію прибирання. Оточення з тимчасовою папкою скорочується до одного рядка, і `tearDown()` стає непотрібним:

```python
import tempfile
import unittest
from pathlib import Path

from reports import save_report


class TestSaveReport(unittest.TestCase):
    def setUp(self):
        # Python 3.11+: входимо в менеджер контексту зараз, виходимо після тесту
        self.folder = Path(self.enterContext(tempfile.TemporaryDirectory()))

    def test_creates_file(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertTrue(path.exists())

    def test_writes_lines(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertEqual(path.read_text(encoding="utf-8"), "jan\nfeb")
```

Результат `python3 -m unittest test_reports_cleanup -v`:

```text
test_creates_file (test_reports_cleanup.TestSaveReport.test_creates_file) ... ok
test_writes_lines (test_reports_cleanup.TestSaveReport.test_writes_lines) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

Та сама ідея існує й для інших рівнів: `addClassCleanup()` і `enterClassContext()` для оточень класу, `unittest.addModuleCleanup()` і `unittest.enterModuleContext()` для оточень модуля (варіанти `enter...Context` — починаючи з Python 3.11).

## Оточення рівня класу: `setUpClass()` і `tearDownClass()`

Деяку підготовку надто довго повторювати для кожного тесту: запуск сервера, завантаження великого файлу з даними, відкриття бази даних. `setUpClass()` виконується **один раз перед усіма тестами класу**, а `tearDownClass()` — один раз після них. Обидва методи отримують клас (`cls`), тому їх треба позначати декоратором `@classmethod`, а все, що вони зберігають, стає **атрибутом класу**, спільним для всіх тестів.

Спільний стан небезпечний: один тест може його змінити й зламати наступний. Поширений підхід поєднує обидва рівні: дорогий ресурс живе на рівні класу, а `setUp()`/`tearDown()` скидають дешевий стан кожного тесту.

```python
import sqlite3
import unittest


class TestUsersTable(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # одне з'єднання й одна таблиця для всіх тестів класу
        cls.conn = sqlite3.connect(":memory:")
        cls.conn.execute("CREATE TABLE users (name TEXT UNIQUE)")

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        self.conn.execute("INSERT INTO users VALUES ('olena')")

    def tearDown(self):
        # скасовуємо все, що змінив тест, щоб наступний почав із чистого стану
        self.conn.rollback()

    def test_count(self):
        (count,) = self.conn.execute("SELECT COUNT(*) FROM users").fetchone()
        self.assertEqual(count, 1)

    def test_duplicate_name(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("INSERT INTO users VALUES ('olena')")

    def test_add_second_user(self):
        self.conn.execute("INSERT INTO users VALUES ('taras')")
        (count,) = self.conn.execute("SELECT COUNT(*) FROM users").fetchone()
        self.assertEqual(count, 2)
```

Результат `python3 -m unittest -v`:

```text
test_add_second_user (test_users.TestUsersTable.test_add_second_user) ... ok
test_count (test_users.TestUsersTable.test_count) ... ok
test_duplicate_name (test_users.TestUsersTable.test_duplicate_name) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.002s

OK
```

`test_add_second_user` виконується першим (алфавітний порядок) і залишає по собі два рядки, проте `test_count` усе одно бачить рівно один. Це `rollback()` у `tearDown()` скасував незафіксовані вставки. Через `self.conn` кожен тест читає спільний атрибут класу.

Якщо `setUpClass()` генерує виняток, жоден тест класу не запускається, а звіт показує одну помилку з назвою `setUpClass (module.ClassName)`. `tearDownClass()` у такому разі теж пропускається, тож якщо підготовка може обірватися частково, реєструйте прибирання рівня класу через `cls.addClassCleanup()`.

## Оточення рівня модуля: `setUpModule()` і `tearDownModule()`

`setUpModule()` і `tearDownModule()` — звичайні функції, визначені на верхньому рівні тестового модуля. Вони виконуються один раз: перед першим тестом модуля й після останнього, для **всіх** тестових класів у цьому файлі:

```python
import unittest


def setUpModule():
    print("Running setUpModule")


def tearDownModule():
    print("Running tearDownModule")


class TestMyModule(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(5 + 5, 10)

    def test_case_2(self):
        self.assertEqual(1 + 1, 2)
```

Результат `python3 -m unittest -v` у терміналі:

```text
Running setUpModule
test_case_1 (test_my_module.TestMyModule.test_case_1) ... ok
test_case_2 (test_my_module.TestMyModule.test_case_2) ... ok
Running tearDownModule

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Типове застосування — глобальне налаштування, потрібне багатьом класам, наприклад встановлення змінної середовища чи запуск одного спільного тестового сервера. Користуйтеся цим ощадливо. Що ширша область дії оточення, то більше тестів від нього залежать і то важче запустити один тест окремо.

## Типові помилки

- **Неправильний регістр літер.** `def setup(self)` чи `def teardown(self)` — це просто звичайні методи, які ніхто не викликає. Тести тоді падають із заплутаними помилками:

  ```text
  AttributeError: 'TestCounter' object has no attribute 'counter'
  ```

  Правильні назви: `setUp`, `tearDown`, `setUpClass`, `tearDownClass`, `setUpModule`, `tearDownModule`.

- **Забутий `@classmethod`.** Без нього `setUpClass(cls)` неможливо викликати на класі, жоден тест класу не запускається, і ви отримуєте:

  ```text
  ERROR: setUpClass (test_noclassmethod.TestNoClassmethod)
  ----------------------------------------------------------------------
  TypeError: TestNoClassmethod.setUpClass() missing 1 required positional argument: 'cls'
  ```

- **Змінювані атрибути класу як оточення.** Список, оголошений у тілі класу, спільний для всіх тестів:

  ```python
  import unittest


  class TestSharedList(unittest.TestCase):
      items = []

      def test_first(self):
          self.items.append("first")
          self.assertEqual(self.items, ["first"])

      def test_second(self):
          self.items.append("second")
          self.assertEqual(self.items, ["second"])
  ```

  `test_second` не проходить із повідомленням `Lists differ: ['first', 'second'] != ['second']`. Гірше того, результат залежить від порядку тестів. Створюйте змінюваний стан у `setUp()`.

- **Забутий `super().setUp()`.** Коли ваш тестовий клас успадковує базовий тестовий клас із власним `setUp()`, викликайте `super().setUp()` (і `super().tearDown()`), інакше базова підготовка мовчки не виконається.
- **Покладатися на `tearDown()` після частково виконаного `setUp()`.** Якщо `setUp()` може обірватися на півдорозі, викликайте `addCleanup()` або `enterContext()` одразу після отримання кожного ресурсу.
- **Повільна робота в `setUp()`.** Відкриття з'єднання з базою 500 разів робить набір тестів повільним. Перенесіть його в `setUpClass()`, а для кожного тесту скидайте лише дешевий стан.

## Підсумок

- Тестове оточення — це підготовка, потрібна тесту, плюс прибирання після нього.
- `setUp()`/`tearDown()` виконуються навколо **кожного** тесту. Крім того, кожен тест отримує новий екземпляр тестового класу, що забезпечує ізоляцію.
- `setUpClass()`/`tearDownClass()` (методи класу) виконуються один раз на клас. `setUpModule()`/`tearDownModule()` (функції) — один раз на модуль.
- Порядок: підготовка модуля, підготовка класу, далі для кожного тесту `setUp` -> тест -> `tearDown`, потім прибирання класу й наостанок прибирання модуля.
- `tearDown()` виконується, навіть коли тест не пройшов, але не виконується, якщо виняток згенерував `setUp()`.
- `addCleanup()` реєструє функції прибирання, які виконуються завжди, у зворотному порядку. `enterContext()` (3.11+) робить це для менеджерів контексту одним викликом.
- На рівні класу чи модуля спільно використовуйте лише дорогі ресурси, які фактично не змінюються, а стан окремого тесту скидайте в `setUp()`/`tearDown()`.

## Практика

### Вправа 1: Передбачте порядок

Не запускаючи код, запишіть, у якому порядку з'являться рядки, якщо виконати `python3 -m unittest -v` у терміналі. Чи виконається `tearDown` після тесту, що не пройшов?

```python
import unittest


class TestOrder(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("setUpClass")

    @classmethod
    def tearDownClass(cls):
        print("tearDownClass")

    def setUp(self):
        print("setUp")

    def tearDown(self):
        print("tearDown")

    def test_b(self):
        print("test_b")

    def test_a(self):
        print("test_a")
        self.assertEqual(1, 2)
```

### Вправа 2: Приберіть дублювання

Файл `cart.py` містить:

```python
class ShoppingCart:
    def __init__(self):
        self._items = []

    def add(self, name, price):
        self._items.append((name, price))

    def total(self):
        return sum(price for _, price in self._items)

    def count(self):
        return len(self._items)
```

Перепишіть ці тести з використанням `setUp()`. Потім поясніть, чому додавання сумки в `test_add_more` не змінює результат `test_count`.

```python
import unittest

from cart import ShoppingCart


class TestShoppingCart(unittest.TestCase):
    def test_total(self):
        cart = ShoppingCart()
        cart.add("book", 12)
        cart.add("pen", 3)
        self.assertEqual(cart.total(), 15)

    def test_count(self):
        cart = ShoppingCart()
        cart.add("book", 12)
        cart.add("pen", 3)
        self.assertEqual(cart.count(), 2)

    def test_add_more(self):
        cart = ShoppingCart()
        cart.add("book", 12)
        cart.add("pen", 3)
        cart.add("bag", 25)
        self.assertEqual(cart.total(), 40)
```

### Вправа 3: Оточення з тимчасовою папкою

Файл `lines.py` містить:

```python
def count_lines(path):
    with open(path, encoding="utf-8") as f:
        return sum(1 for _ in f)
```

Напишіть `test_lines.py` з тестовим оточенням, яке для кожного тесту створює нову тимчасову папку й гарантовано видаляє її, навіть якщо тест не пройшов. Додайте допоміжний метод `write(name, text)`, що створює файл у цій папці, і протестуйте три випадки: файл із трьома рядками, файл, останній рядок якого не закінчується символом нового рядка, і порожній файл.

### Вправа 4: Знайдіть помилку

Обидва тести нижче завершуються з `ERROR`. Поясніть чому й виправте клас, змінивши одне слово.

```python
import unittest


class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1


class TestCounter(unittest.TestCase):
    def setup(self):
        self.counter = Counter()

    def test_starts_at_zero(self):
        self.assertEqual(self.counter.value, 0)

    def test_increment(self):
        self.counter.increment()
        self.assertEqual(self.counter.value, 1)
```

## Розв'язки

### Вправа 1

Результат (шлях скорочено, час щоразу інший):

```text
setUpClass
test_a (test_order.TestOrder.test_a) ... setUp
test_a
FAIL
tearDown
test_b (test_order.TestOrder.test_b) ... setUp
test_b
tearDown
ok
tearDownClass

======================================================================
FAIL: test_a (test_order.TestOrder.test_a)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_order.py", line 24, in test_a
    self.assertEqual(1, 2)
    ~~~~~~~~~~~~~~~~^^^^^^
AssertionError: 1 != 2

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (failures=1)
```

- `test_a` виконується раніше за `test_b`, хоча оголошений пізніше, бо тести запускаються в алфавітному порядку.
- `tearDown` **виконується** й після тесту, що не пройшов. `FAIL` виводиться перед ним, бо про невдачу повідомляється одразу, щойно вона сталася, а `ok` — лише після завершення всього тесту, включно з `tearDown()`.
- `setUpClass` і `tearDownClass` виконуються рівно один раз.

### Вправа 2

```python
import unittest

from cart import ShoppingCart


class TestShoppingCart(unittest.TestCase):
    def setUp(self):
        self.cart = ShoppingCart()
        self.cart.add("book", 12)
        self.cart.add("pen", 3)

    def test_total(self):
        self.assertEqual(self.cart.total(), 15)

    def test_count(self):
        self.assertEqual(self.cart.count(), 2)

    def test_add_more(self):
        self.cart.add("bag", 25)
        self.assertEqual(self.cart.total(), 40)
```

Результат `python3 -m unittest -v`:

```text
test_add_more (test_cart.TestShoppingCart.test_add_more) ... ok
test_count (test_cart.TestShoppingCart.test_count) ... ok
test_total (test_cart.TestShoppingCart.test_total) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`test_add_more` виконується першим і додає третій товар, але лише у *свій* кошик. Перед `test_count` метод `setUp()` знову виконується на новому екземплярі тесту й створює зовсім новий кошик із двома товарами.

### Вправа 3

```python
import tempfile
import unittest
from pathlib import Path

from lines import count_lines


class TestCountLines(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name)

    def write(self, name, text):
        path = self.folder / name
        path.write_text(text, encoding="utf-8")
        return path

    def test_three_lines(self):
        path = self.write("a.txt", "one\ntwo\nthree\n")
        self.assertEqual(count_lines(path), 3)

    def test_last_line_without_newline(self):
        path = self.write("b.txt", "one\ntwo")
        self.assertEqual(count_lines(path), 2)

    def test_empty_file(self):
        path = self.write("c.txt", "")
        self.assertEqual(count_lines(path), 0)
```

Результат `python3 -m unittest -v`:

```text
test_empty_file (test_lines.TestCountLines.test_empty_file) ... ok
test_last_line_without_newline (test_lines.TestCountLines.test_last_line_without_newline) ... ok
test_three_lines (test_lines.TestCountLines.test_three_lines) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

`addCleanup(tmp.cleanup)` реєструється одразу після створення папки, тож вона видаляється після кожного тесту, хоч би чим той завершився. `write()` не має префікса `test`, тому засіб запуску вважає його допоміжним методом. У Python 3.11+ перші три рядки `setUp()` можна замінити на `self.folder = Path(self.enterContext(tempfile.TemporaryDirectory()))`.

### Вправа 4

Метод називається `setup`, а не `setUp`. `unittest` викликає лише метод із точною назвою `setUp`, тому `self.counter` так і не створюється, і обидва тести генерують `AttributeError: 'TestCounter' object has no attribute 'counter'`. Виправте назву:

```python
class TestCounter(unittest.TestCase):
    def setUp(self):
        self.counter = Counter()

    def test_starts_at_zero(self):
        self.assertEqual(self.counter.value, 0)

    def test_increment(self):
        self.counter.increment()
        self.assertEqual(self.counter.value, 1)
```

Результат `python3 -m unittest -v`:

```text
test_increment (test_counter.TestCounter.test_increment) ... ok
test_starts_at_zero (test_counter.TestCounter.test_starts_at_zero) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

---

*Джерело: [pythontutorial.net — Python Test Fixtures](https://www.pythontutorial.net/python-unit-testing/python-test-fixtures/). Адаптовано й доповнено для PyJourney.*
